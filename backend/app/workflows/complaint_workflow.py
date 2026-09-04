"""LangGraph pipeline orchestrating the CivicFix agents.

Live pipeline (wired into POST /complaints/analyze):

    vision -> location -> routing --(analyze mode)--> END
                                   --(full mode)-----> complaint -> tracking

All five agents are implemented. The /complaints/analyze endpoint invokes
the graph in "analyze" mode, which stops after routing and returns the
three enrichments (analysis, location, routing) - the same contract the
endpoint used to produce with inline code. A "full" run additionally
assembles the validated record (complaint node) and mints the tracking ID
(tracking node); that path is reserved for the save step of a future
end-to-end endpoint.

Failure semantics mirror the endpoint contract:
  * vision is REQUIRED - if it raises, the run aborts and the route turns
    the exception into a clean 502/503.
  * location and routing are BEST-EFFORT - each node catches its own
    failures, leaves its output None, and records the error in
    state["errors"] so the analysis still succeeds.
  * location only runs when the caller supplied lat/lng (browser GPS on
    the /report page); without coords the frontend asks the citizen to
    type the ward instead.
"""

from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.agents.complaint_agent import ComplaintAgent
from app.agents.location_agent import LocationAgent
from app.agents.routing_agent import RoutingAgent
from app.agents.tracking_agent import TrackingAgent
from app.agents.vision_agent import VisionAgent


class WorkflowState(TypedDict, total=False):
    # Inputs
    image_path: str
    content_type: str
    lat: float | None
    lng: float | None
    mode: str  # "analyze" stops after routing; anything else runs the full graph

    # Node outputs (None means "best-effort step skipped or failed")
    vision: dict
    location: dict | None
    routing: dict | None
    complaint: dict
    tracking: dict

    # Errors collected from best-effort steps (never fatal)
    errors: dict


vision = VisionAgent()
location = LocationAgent()
routing = RoutingAgent()
complaint = ComplaintAgent()
tracking = TrackingAgent()


async def vision_node(state: WorkflowState) -> WorkflowState:
    """Identify the civic issue shown in the photo.

    Required step: exceptions propagate and abort the graph, which the
    route maps to a clean HTTP error.
    """
    state["vision"] = await vision.analyze(
        state["image_path"],
        content_type=state.get("content_type") or "image/jpeg",
    )
    return state


async def location_node(state: WorkflowState) -> WorkflowState:
    """Pin down where the issue is, from GPS + the vision description.

    Best-effort and only meaningful when the caller supplied real
    coordinates (the vision model cannot invent GPS from a photo).
    """
    errors = state.setdefault("errors", {})
    lat, lng = state.get("lat"), state.get("lng")
    if lat is None or lng is None:
        state["location"] = None
        return state
    try:
        state["location"] = await location.extract_location(
            description=state["vision"].get("description", ""),
            lat=lat,
            lng=lng,
            photo_urls=[state["image_path"]],
        )
    except Exception as exc:  # noqa: BLE001 - best-effort by contract
        print(f"Location agent failed: {exc}")
        state["location"] = None
        errors["location"] = str(exc)
    return state


async def routing_node(state: WorkflowState) -> WorkflowState:
    """Decide which civic department should handle the issue. Best-effort."""
    errors = state.setdefault("errors", {})
    try:
        state["routing"] = await routing.route_to_department(
            category=state["vision"].get("issue_type", ""),
            ward=(state.get("location") or {}).get("ward"),
            severity=state["vision"].get("severity"),
            description=state["vision"].get("description", ""),
        )
    except Exception as exc:  # noqa: BLE001 - best-effort by contract
        print(f"Routing agent failed: {exc}")
        state["routing"] = None
        errors["routing"] = str(exc)
    return state


async def complaint_node(state: WorkflowState) -> WorkflowState:
    """Assemble one validated complaint record from the upstream outputs."""
    state["complaint"] = await complaint.build_complaint(
        {
            "vision": state["vision"],
            "location": state.get("location"),
            "routing": state.get("routing"),
        }
    )
    return state


async def tracking_node(state: WorkflowState) -> WorkflowState:
    """Issue a tracking ID for the complaint."""
    complaint_id = str(state["complaint"].get("id", ""))
    tracking_id = await tracking.create_tracking_id(complaint_id)
    state["tracking"] = {"tracking_id": tracking_id}
    return state


def _after_routing(state: WorkflowState) -> str:
    """Stop at routing for /complaints/analyze; otherwise keep going.

    LangGraph routes on the returned key, so "analyze" mode ends here and
    never mints an ID or assembles the record for a response the endpoint
    does not need.
    """
    if state.get("mode") == "analyze":
        return END
    return "complaint"


def build_complaint_workflow():
    graph = StateGraph(WorkflowState)

    graph.add_node("vision", vision_node)
    graph.add_node("location", location_node)
    graph.add_node("routing", routing_node)
    graph.add_node("complaint", complaint_node)
    graph.add_node("tracking", tracking_node)

    graph.set_entry_point("vision")

    graph.add_edge("vision", "location")
    graph.add_edge("location", "routing")
    graph.add_conditional_edges(
        "routing",
        _after_routing,
        {END: END, "complaint": "complaint"},
    )
    graph.add_edge("complaint", "tracking")
    graph.add_edge("tracking", END)

    return graph.compile()


# The compiled graph is stateless per invocation (no checkpointer), so one
# shared instance is safe for concurrent requests.
_workflow = None


def get_complaint_workflow():
    """Return the compiled complaint workflow, building it once."""
    global _workflow
    if _workflow is None:
        _workflow = build_complaint_workflow()
    return _workflow