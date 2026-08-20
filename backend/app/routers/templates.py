from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_subscribed_user
from app.database import get_db
from app.models import Template, TemplateField, User
from app.schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
) -> Template:
    existing = (
        db.query(Template)
        .filter(Template.name == payload.name, Template.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(409, f"A template named '{payload.name}' already exists.")

    template = Template(name=payload.name, user_id=user.id)
    for i, f in enumerate(payload.fields):
        template.fields.append(
            TemplateField(
                name=f.name,
                field_type=f.field_type.value,
                regex_pattern=f.regex_pattern,
                required=f.required,
                position=i,
            )
        )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db), user: User = Depends(get_current_subscribed_user)
) -> list[Template]:
    return (
        db.query(Template)
        .filter(Template.user_id == user.id)
        .order_by(Template.created_at.desc())
        .all()
    )


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
) -> Template:
    template = db.get(Template, template_id)
    # 404 (not 403) when it exists but belongs to someone else — don't leak
    # that a given ID is a real template via a distinguishable status code.
    if not template or template.user_id != user.id:
        raise HTTPException(404, "Template not found.")
    return template


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: str,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
) -> Template:
    template = db.get(Template, template_id)
    if not template or template.user_id != user.id:
        raise HTTPException(404, "Template not found.")

    name_conflict = (
        db.query(Template)
        .filter(
            Template.name == payload.name,
            Template.user_id == user.id,
            Template.id != template_id,
        )
        .first()
    )
    if name_conflict:
        raise HTTPException(409, f"A template named '{payload.name}' already exists.")

    template.name = payload.name
    template.fields.clear()
    for i, f in enumerate(payload.fields):
        template.fields.append(
            TemplateField(
                name=f.name,
                field_type=f.field_type.value,
                regex_pattern=f.regex_pattern,
                required=f.required,
                position=i,
            )
        )
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
) -> None:
    template = db.get(Template, template_id)
    if not template or template.user_id != user.id:
        raise HTTPException(404, "Template not found.")
    db.delete(template)
    db.commit()
