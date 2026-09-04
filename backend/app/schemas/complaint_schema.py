"""Pydantic request/response models for complaints (DRAFT).

Nothing is defined yet on purpose: complaint submission is a later milestone.
When it lands, this module will hold models like:

    class ComplaintCreate(BaseModel):   # request body for POST /complaints
        title: str
        description: str
        # location, photos, category ...

    class ComplaintOut(ComplaintCreate):  # response shape
        id: str
        tracking_id: str
        status: str
        created_at: datetime

Keep schemas here (not in routes) so agents, services, and routes all share
one source of truth for the complaint shape.
"""
