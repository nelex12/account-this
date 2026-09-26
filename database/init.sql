CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    age INT NOT NULL CHECK (age BETWEEN 0 AND 150),
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female'))
);