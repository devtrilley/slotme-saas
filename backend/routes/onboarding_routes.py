from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin
from models import db, Freelancer
from config import ALLOWED_ORIGINS

onboarding_bp = Blueprint("onboarding", __name__, url_prefix="/onboarding")


@onboarding_bp.get("/status")
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@jwt_required()
def get_onboarding_status():
    """Get onboarding status including individual step completion"""
    freelancer_id = get_jwt_identity()
    freelancer = Freelancer.query.get(int(freelancer_id))

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    steps_completed = freelancer.onboarding_steps_completed or {}

    return (
        jsonify(
            {
                "completed": freelancer.onboarding_completed or False,
                "steps_completed": steps_completed,
            }
        ),
        200,
    )


from sqlalchemy.orm.attributes import flag_modified  # ✅ ADD THIS IMPORT AT TOP


@onboarding_bp.post("/mark-step/<int:step_id>")
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@jwt_required()
def mark_step_complete(step_id):
    """Mark a specific onboarding step as complete"""
    freelancer_id = get_jwt_identity()
    freelancer = Freelancer.query.get(int(freelancer_id))

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    if step_id < 1 or step_id > 7:  # ✅ Now 7 steps (added payment info)
        return jsonify({"error": "Invalid step ID"}), 400

    # Get existing steps or initialize empty dict
    steps = freelancer.onboarding_steps_completed or {}
    steps[f"step{step_id}"] = True

    freelancer.onboarding_steps_completed = steps
    flag_modified(
        freelancer, "onboarding_steps_completed"
    )  # ✅ TELL SQLALCHEMY IT CHANGED
    db.session.commit()

    return (
        jsonify(
            {"message": f"Step {step_id} marked complete", "steps_completed": steps}
        ),
        200,
    )


@onboarding_bp.post("/dismiss")
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@jwt_required()
def dismiss_onboarding():
    """Dismiss the onboarding banner (mark as completed)"""
    freelancer_id = get_jwt_identity()
    freelancer = Freelancer.query.get(int(freelancer_id))

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.onboarding_completed = True
    db.session.commit()

    return jsonify({"message": "Onboarding dismissed!"}), 200
