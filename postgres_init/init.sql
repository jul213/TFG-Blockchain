-- Tabla de Usuarios (Roles y Login)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) CHECK (role IN ('RECTOR', 'TEACHER', 'STUDENT'))
);

-- Tabla de Cursos
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    teacher_id INTEGER REFERENCES users(id)
);

-- Tabla de Matriculaciones (Muchos a Muchos)
CREATE TABLE IF NOT EXISTS enrollments (
    student_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    PRIMARY KEY (student_id, course_id)
);

-- Tabla de Notas selladas en blockchain
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    grade NUMERIC(4,2) NOT NULL CHECK (grade >= 0 AND grade <= 10),
    blockchain_hash VARCHAR(100) NOT NULL,
    request_id VARCHAR(80),
    block_number INTEGER,
    gas_used INTEGER,
    event_type VARCHAR(80) DEFAULT 'WRITE_GRADE',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(80),
    event_type VARCHAR(80) NOT NULL,
    actor VARCHAR(150),
    role VARCHAR(20),
    subject VARCHAR(180),
    status VARCHAR(32) NOT NULL,
    severity VARCHAR(20) DEFAULT 'low',
    mitre VARCHAR(20) DEFAULT 'TA0000',
    db_id INTEGER,
    blockchain_hash VARCHAR(100),
    block_number INTEGER,
    gas_used INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_request_id ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_blockchain_hash ON audit_events(blockchain_hash);
CREATE INDEX IF NOT EXISTS idx_grades_request_id ON grades(request_id);
CREATE INDEX IF NOT EXISTS idx_grades_blockchain_hash ON grades(blockchain_hash);

-- Insertar o actualizar usuarios iniciales con hash bcrypt
INSERT INTO users (username, password_hash, full_name, role) VALUES
('rector@uni.edu', '$2b$10$2r3pkQmXnCqPz4oMGqweDOFsfS.iviA94lZ/V1D5KZYdBeni/nqxy', 'Dr. Javier Pérez', 'RECTOR'),
('rector.seguridad@uni.edu', '$2b$10$3H4SSylYpVUSanWlk2M6J.N8RwkSbp/IhQy7P6w49lnC/1WMmN03a', 'Dra. Lucía Navarro', 'RECTOR'),
('rector.operaciones@uni.edu', '$2b$10$V0m.jN.j8VSN9xFgTqfAK..CiaE/0Lkcbt75nZSqxizkCXXYxdYLO', 'Dr. Marcos Gil', 'RECTOR'),
('profe@uni.edu', '$2b$10$cRVyFTWg2At0D2ToJj8QZ.up6lRT3JR/VcW/AnqXxvDYSHu8DNVSm', 'Prof. Julio M.', 'TEACHER'),
('redes@uni.edu', '$2b$10$HTUqGsbHTdaaaDUfOUVIvOizjEan24waiLE8UuOpv3Ro4E/O7uU3.', 'Prof. Ana Torres', 'TEACHER'),
('blockchain@uni.edu', '$2b$10$vHJhRjfx6TkhckQKbdl3b.rY9QXnJpN5VrmAb6IThp/vBJ/RBPAkm', 'Prof. Diego Ramos', 'TEACHER'),
('ia@uni.edu', '$2b$10$r27EcW6cg7DyHJdZWnXzKOh0b/tOp1jUtE/CETwEl6tkG7zHJjExu', 'Prof. Sara Molina', 'TEACHER'),
('auditoria@uni.edu', '$2b$10$wU2qWi7I2vmjCIYZiN1DpuQhDwjTmTGrAAAvNUQ0xPu73WJTRamgm', 'Prof. Carlos Vega', 'TEACHER'),
('alumno@uni.edu', '$2b$10$Smyiz0kh32WzNgmBbt.pQ.UXWfT41sTEowaYT/BGVWYmrzvwen3dG', 'Juan Alumno', 'STUDENT')
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
