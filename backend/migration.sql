BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 8f9a50ba4357

INSERT INTO alembic_version (version_num) VALUES ('8f9a50ba4357') RETURNING alembic_version.version_num;

-- Running upgrade 8f9a50ba4357 -> b6d6b4a40df7

CREATE TABLE users (
    id SERIAL NOT NULL, 
    email VARCHAR NOT NULL, 
    username VARCHAR NOT NULL, 
    hashed_password VARCHAR NOT NULL, 
    is_active BOOLEAN, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_id ON users (id);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE trips (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    origin VARCHAR(255) NOT NULL, 
    destination VARCHAR(255) NOT NULL, 
    start_date DATE NOT NULL, 
    end_date DATE NOT NULL, 
    status VARCHAR(50), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_trips_id ON trips (id);

CREATE TABLE incidents (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    incident_type VARCHAR(50), 
    description TEXT, 
    occurred_at TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id)
);

CREATE INDEX ix_incidents_id ON incidents (id);

CREATE TABLE trip_days (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    day_number INTEGER NOT NULL, 
    date DATE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id)
);

CREATE INDEX ix_trip_days_id ON trip_days (id);

CREATE TABLE trip_members (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    user_id INTEGER NOT NULL, 
    role VARCHAR(50) NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id) ON DELETE CASCADE, 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_trip_members_trip_id_user_id UNIQUE (trip_id, user_id)
);

CREATE INDEX ix_trip_members_id ON trip_members (id);

CREATE TYPE trip_atmosphere_enum AS ENUM ('RELAXED', 'ACTIVE', 'GOURMET', 'INSTAGENIC');

CREATE TABLE trip_preferences (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    atmosphere trip_atmosphere_enum NOT NULL, 
    companions VARCHAR(50), 
    budget INTEGER, 
    transport_type VARCHAR(50), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id)
);

CREATE INDEX ix_trip_preferences_id ON trip_preferences (id);

CREATE TABLE itinerary_items (
    id SERIAL NOT NULL, 
    trip_day_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    category VARCHAR(100), 
    latitude FLOAT, 
    longitude FLOAT, 
    start_time TIMESTAMP WITHOUT TIME ZONE, 
    end_time TIMESTAMP WITHOUT TIME ZONE, 
    estimated_cost INTEGER, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_day_id) REFERENCES trip_days (id)
);

CREATE INDEX ix_itinerary_items_id ON itinerary_items (id);

CREATE TABLE replan_sessions (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    incident_id INTEGER, 
    reason TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(incident_id) REFERENCES incidents (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id)
);

CREATE INDEX ix_replan_sessions_id ON replan_sessions (id);

CREATE TABLE replan_items (
    id SERIAL NOT NULL, 
    replan_session_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    category VARCHAR(100), 
    latitude FLOAT, 
    longitude FLOAT, 
    start_time TIMESTAMP WITHOUT TIME ZONE, 
    estimated_cost INTEGER, 
    replacement_for_item_id INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(replacement_for_item_id) REFERENCES itinerary_items (id), 
    FOREIGN KEY(replan_session_id) REFERENCES replan_sessions (id)
);

CREATE INDEX ix_replan_items_id ON replan_items (id);

UPDATE alembic_version SET version_num='b6d6b4a40df7' WHERE alembic_version.version_num = '8f9a50ba4357';

-- Running upgrade b6d6b4a40df7 -> 3e6f97f830a1

ALTER TABLE users ADD COLUMN firebase_uid VARCHAR;

CREATE UNIQUE INDEX ix_users_firebase_uid ON users (firebase_uid);

UPDATE alembic_version SET version_num='3e6f97f830a1' WHERE alembic_version.version_num = 'b6d6b4a40df7';

-- Running upgrade 3e6f97f830a1 -> 0c36f06f0f77

ALTER TABLE users DROP COLUMN hashed_password;

UPDATE alembic_version SET version_num='0c36f06f0f77' WHERE alembic_version.version_num = '3e6f97f830a1';

-- Running upgrade 0c36f06f0f77 -> 9f2a8b7c1d4e

ALTER TABLE users ADD COLUMN profile_image_url VARCHAR;

ALTER TABLE users ADD COLUMN nearest_station VARCHAR;

UPDATE alembic_version SET version_num='9f2a8b7c1d4e' WHERE alembic_version.version_num = '0c36f06f0f77';

-- Running upgrade 9f2a8b7c1d4e -> c1a7b8d9e2f3

CREATE TABLE friends (
    id SERIAL NOT NULL, 
    requester_user_id INTEGER NOT NULL, 
    addressee_user_id INTEGER NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    CONSTRAINT ck_friends_not_self CHECK (requester_user_id <> addressee_user_id), 
    FOREIGN KEY(addressee_user_id) REFERENCES users (id) ON DELETE CASCADE, 
    FOREIGN KEY(requester_user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_friends_requester_addressee UNIQUE (requester_user_id, addressee_user_id)
);

CREATE INDEX ix_friends_id ON friends (id);

CREATE INDEX ix_friends_requester_user_id ON friends (requester_user_id);

CREATE INDEX ix_friends_addressee_user_id ON friends (addressee_user_id);

CREATE INDEX ix_friends_status ON friends (status);

UPDATE alembic_version SET version_num='c1a7b8d9e2f3' WHERE alembic_version.version_num = '9f2a8b7c1d4e';

-- Running upgrade c1a7b8d9e2f3 -> d4f1a8c9b2e3

ALTER TABLE itinerary_items ADD COLUMN sequence INTEGER;

ALTER TABLE trip_preferences ADD CONSTRAINT uq_trip_preferences_trip_id UNIQUE (trip_id);

ALTER TABLE trip_days ADD CONSTRAINT uq_trip_days_trip_id_day_number UNIQUE (trip_id, day_number);

CREATE TABLE ai_plan_generations (
    id SERIAL NOT NULL, 
    trip_id INTEGER NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    provider VARCHAR(100), 
    prompt_version VARCHAR(50), 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    started_at TIMESTAMP WITH TIME ZONE, 
    finished_at TIMESTAMP WITH TIME ZONE, 
    error_message TEXT, 
    result_summary_json TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(trip_id) REFERENCES trips (id)
);

CREATE INDEX ix_ai_plan_generations_id ON ai_plan_generations (id);

UPDATE alembic_version SET version_num='d4f1a8c9b2e3' WHERE alembic_version.version_num = 'c1a7b8d9e2f3';

-- Running upgrade d4f1a8c9b2e3 -> e5b7c2a1d9f4

ALTER TABLE trips ADD COLUMN participant_count INTEGER;

UPDATE trips SET participant_count = 1 WHERE participant_count IS NULL;

ALTER TABLE trips ALTER COLUMN participant_count SET NOT NULL;

UPDATE alembic_version SET version_num='e5b7c2a1d9f4' WHERE alembic_version.version_num = 'd4f1a8c9b2e3';

-- Running upgrade e5b7c2a1d9f4 -> f6a1c9d2b4e7

ALTER TABLE trips ADD COLUMN is_public BOOLEAN;

ALTER TABLE trips ADD COLUMN cover_image_url VARCHAR(1000);

ALTER TABLE trips ADD COLUMN recommendation_category VARCHAR(100);

ALTER TABLE trips ADD COLUMN like_count INTEGER;

UPDATE trips SET is_public = FALSE WHERE is_public IS NULL;

UPDATE trips SET like_count = 0 WHERE like_count IS NULL;

ALTER TABLE trips ALTER COLUMN is_public SET NOT NULL;

ALTER TABLE trips ALTER COLUMN like_count SET NOT NULL;

UPDATE alembic_version SET version_num='f6a1c9d2b4e7' WHERE alembic_version.version_num = 'e5b7c2a1d9f4';

-- Running upgrade f6a1c9d2b4e7 -> f8b2d4c6e1a9

ALTER TABLE trips RENAME like_count TO save_count;

UPDATE alembic_version SET version_num='f8b2d4c6e1a9' WHERE alembic_version.version_num = 'f6a1c9d2b4e7';

-- Running upgrade f8b2d4c6e1a9 -> a1c3d5e7f901

ALTER TABLE trips ADD COLUMN source_trip_id INTEGER;

ALTER TABLE trips ADD COLUMN counts_as_saved_recommendation BOOLEAN;

UPDATE trips SET counts_as_saved_recommendation = FALSE WHERE counts_as_saved_recommendation IS NULL;

ALTER TABLE trips ALTER COLUMN counts_as_saved_recommendation SET NOT NULL;

ALTER TABLE trips ADD CONSTRAINT fk_trips_source_trip_id_trips FOREIGN KEY(source_trip_id) REFERENCES trips (id);

UPDATE alembic_version SET version_num='a1c3d5e7f901' WHERE alembic_version.version_num = 'f8b2d4c6e1a9';

-- Running upgrade a1c3d5e7f901 -> b2f4d6e8a102

ALTER TABLE trips ADD COLUMN recommendation_categories VARCHAR(100)[];

UPDATE trips
        SET recommendation_categories =
          CASE
            WHEN recommendation_category IS NULL OR btrim(recommendation_category) = '' THEN ARRAY[]::varchar[]
            ELSE regexp_split_to_array(recommendation_category, '\s*,\s*')
          END;

ALTER TABLE trips DROP COLUMN recommendation_category;

UPDATE alembic_version SET version_num='b2f4d6e8a102' WHERE alembic_version.version_num = 'a1c3d5e7f901';

-- Running upgrade b2f4d6e8a102 -> c4d6e8f0a113

ALTER TABLE itinerary_items ADD COLUMN item_type VARCHAR(50);

ALTER TABLE itinerary_items ADD COLUMN transport_mode VARCHAR(50);

ALTER TABLE itinerary_items ADD COLUMN travel_minutes INTEGER;

ALTER TABLE itinerary_items ADD COLUMN distance_meters INTEGER;

ALTER TABLE itinerary_items ADD COLUMN from_name VARCHAR(255);

ALTER TABLE itinerary_items ADD COLUMN to_name VARCHAR(255);

UPDATE itinerary_items SET item_type = 'place' WHERE item_type IS NULL;

ALTER TABLE itinerary_items ALTER COLUMN item_type SET NOT NULL;

UPDATE alembic_version SET version_num='c4d6e8f0a113' WHERE alembic_version.version_num = 'b2f4d6e8a102';

-- Running upgrade c4d6e8f0a113 -> d5e7f9a1b214

ALTER TABLE trips ADD COLUMN recommendation_comment TEXT;

UPDATE alembic_version SET version_num='d5e7f9a1b214' WHERE alembic_version.version_num = 'c4d6e8f0a113';

-- Running upgrade d5e7f9a1b214 -> e7c9a1f2b345

ALTER TABLE itinerary_items ADD COLUMN line_name VARCHAR(255);

ALTER TABLE itinerary_items ADD COLUMN vehicle_type VARCHAR(255);

ALTER TABLE itinerary_items ADD COLUMN departure_stop_name VARCHAR(255);

ALTER TABLE itinerary_items ADD COLUMN arrival_stop_name VARCHAR(255);

UPDATE alembic_version SET version_num='e7c9a1f2b345' WHERE alembic_version.version_num = 'd5e7f9a1b214';

-- Running upgrade e7c9a1f2b345 -> a9d3f1b2c7e4

ALTER TABLE trip_preferences ADD COLUMN example_preference VARCHAR(255);

ALTER TABLE trip_days ADD COLUMN example_day_attribute VARCHAR(255);

UPDATE alembic_version SET version_num='a9d3f1b2c7e4' WHERE alembic_version.version_num = 'e7c9a1f2b345';
COMMIT;

