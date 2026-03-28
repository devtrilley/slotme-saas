from itsdangerous import URLSafeTimedSerializer
import os

serializer = URLSafeTimedSerializer(os.getenv("FLASK_SECRET_KEY", "changeme"))
