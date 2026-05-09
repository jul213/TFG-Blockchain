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

-- Insertar datos de prueba (Las contraseñas se actualizarán luego con Bcrypt)
INSERT INTO users (username, password_hash, full_name, role) VALUES 
('rector@uni.edu', 'hash_provisional', 'Dr. Javier Pérez', 'RECTOR'),
('profe@uni.edu', 'hash_provisional', 'Prof. Julio M.', 'TEACHER'),
('alumno@uni.edu', 'hash_provisional', 'Juan Alumno', 'STUDENT');
