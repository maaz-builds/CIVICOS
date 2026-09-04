"""LangGraph workflow for complaint processing (NOT implemented yet).

Future pipeline (later milestone):

    photo + description
        -> VisionAgent       (what is it? how bad?)
        -> LocationAgent     (where is it?)
        -> RoutingAgent      (which department?)
        -> ComplaintAgent     (assemble + validate the record)
        -> TrackingAgent      (tracking ID + status)
        -> SupabaseService    (persist)

LangGraph is intentionally NOT installed yet (see requirements.txt), so this
module only sketches the shape. The agents must be finished first.
"""


def build_complaint_workflow() -> "object":
    """Build and return the compiled LangGraph graph (implement later).

    TODO(workflow milestone): define the StateGraph with the nodes above,
    then compile it. Keep the langgraph import inside this function so the
    module still imports before LangGraph is installed.
    """
    raise NotImplementedError(
        "build_complaint_workflow is not implemented yet - requires LangGraph "
        "and the finished agents."
    )
