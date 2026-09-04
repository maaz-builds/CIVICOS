from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.agents.vision_agent import VisionAgent
from app.agents.location_agent import LocationAgent
from app.agents.routing_agent import RoutingAgent
from app.agents.complaint_agent import ComplaintAgent
from app.agents.tracking_agent import TrackingAgent


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


async def vision_node(state: WorkflowState):
    state["vision"] = await vision.analyze(state["image_path"])
    return state


async def location_node(state: WorkflowState):
    state["location"] = await location.locate(state["image_path"])
    return state


async def routing_node(state: WorkflowState):
    state["routing"] = await routing.route(
        state["vision"],
        state["location"]
    )
    return state


async def complaint_node(state: WorkflowState):
    state["complaint"] = await complaint.generate(
        state["vision"],
        state["location"],
        state["routing"]
    )
    return state


async def tracking_node(state: WorkflowState):
    state["tracking"] = await tracking.create(
        state["complaint"]
    )
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