class BaseError(Exception):
    """Base error class"""
    pass


class UserNotFoundError(BaseError):
    """User not found error"""
    pass


class UserAlreadyExistsError(BaseError):
    """User already exists error"""
    pass


class TripNotFoundError(BaseError):
    """Trip not found error"""
    pass


class PermissionDeniedError(BaseError):
    """Permission denied error"""
    pass


class ValidationError(BaseError):
    """Validation error"""
    pass


class DatabaseError(BaseError):
    """Database error"""
    pass 
