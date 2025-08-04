def load_freelancer():
    request.path = request.path.rstrip("/")
    print("🔥 Path:", request.path)
    print("🔥 Headers:", dict(request.headers))
    print(f"🔥 Incoming {request.method} {request.path}")

    if request.method == "OPTIONS":
        return

    open_prefixes = (
        "/auth",
        "/signup",
        "/seed",
        "/verify",
        "/dev",
        "/404",
        "/master-times",
        "/appointment",
        "/freelancer/public-info",
        "/freelancer/slots",
        "/confirm-booking",
        "/check-booking-status",
        "/resend-confirmation",
        "/check-session-status",
        "/download-ics",
    )
    open_paths = [
        "/book",
        "/feedback",
        "/confirm-booking",
        "/appointment",
        "/download-ics",
        "/webhook",
        "/upgrade-success",
        "/upgrade-cancelled",
    ]

    if (
        any(request.path.startswith(prefix) for prefix in open_prefixes)
        or request.path in open_paths
        or request.endpoint == "public_profile_by_url"
        or is_valid_public_slug(request.path.lower())
        or request.path == "/404"
    ):
        print("✅ Skipping auth for open or public path.")
        return

    # 💥 Add this diagnostic log to catch blocked requests
    print("🚫 BLOCKING REQUEST — NOT IN open_prefixes or open_paths")
    print("🚫 Full request.path:", request.path)

    try:
        verify_jwt_in_request()
        g.freelancer_id = get_jwt_identity()
        print("✅ Authenticated as freelancer:", g.freelancer_id)
    except NoAuthorizationError:
        print("❌ Missing or invalid JWT token")
        return jsonify({"error": "Missing or invalid token"}), 401