"""LangGraph pipeline orchestrating the CivicFix agents.

Drafted pipeline (not wired to an endpoint yet):

    vision -> location -> routing -> complaint -> tracking

Vision, location, and tracking IDs are implemented. The routing and
complaint agents still raise NotImplementedError, so the graph only
becomes runnable once those two land. The node calls below match each
agent's declared interface, so no further changes are needed then.
"""

from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.agents.complaint_agent import ComplaintAgent
from app.agents.location_agent import LocationAgent
from app.agents.routing_agent import RoutingAgent
from app.agents.tracking_agent import TrackingAgent
from app.agents.vision_agent import VisionAgent


class WorkflowState(TypedDict):
    image_path: str
    vision: dict
    location: dict
    routing: dict
    complaint: dict
    tracking: dict


vision = VisionAgent()
location = LocationAgent()
routing = RoutingAgent()
complaint = ComplaintAgent()
tracking = TrackingAgent()


async def vision_node(state: WorkflowState) -> WorkflowState:
    """Identify the civic issue shown in the photo."""
    state["vision"] = await vision.analyze(state["image_path"])
    return state


async def location_node(state: WorkflowState) -> WorkflowState:
    """Pin down where the issue is, from the vision description + photo."""
    state["location"] = await location.extract_location(
        description=state["vision"].get("description", ""),
        photo_urls=[state["image_path"]],
    )
    return state


async def routing_node(state: WorkflowState) -> WorkflowState:
    """Decide which civic department should handle the issue."""
    state["routing"] = await routing.route_to_department(
        category=state["vision"].get("issue_type", ""),
        ward=state["location"].get("ward"),
    )
    return state


async def complaint_node(state: WorkflowState) -> WorkflowState:
    """Assemble one validated complaint record from the upstream outputs."""
    state["complaint"] = await complaint.build_complaint(
        {
            "vision": state["vision"],
            "location": state["location"],
            "routing": state["routing"],
        }
    )
    return state


async def tracking_node(state: WorkflowState) -> WorkflowState:
    """Issue a tracking ID for the complaint."""
    complaint_id = str(state["complaint"].get("id", ""))
    tracking_id = await tracking.create_tracking_id(complaint_id)
    state["tracking"] = {"tracking_id": tracking_id}
    return state


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
    graph.add_edge("routing", "complaint")
    graph.add_edge("complaint", "tracking")
    graph.add_edge("tracking", END)

    return graph.compile()
