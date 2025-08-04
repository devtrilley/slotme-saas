def is_valid_public_slug(path):
    """
    Only match slugs like '/ambercafe' if they exist in DB, avoid reserved routes.
    """
    if not re.fullmatch(r"/[a-z0-9_-]{3,30}", path):
        return False

    slug = path.lstrip("/")
    if slug in RESERVED_ROUTES:
        return False

    return Freelancer.query.filter_by(custom_url=slug).first() is not None