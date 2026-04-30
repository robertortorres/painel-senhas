CREATE DATABASE IF NOT EXISTS clinicasga CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinicasga;

CREATE TABLE unidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  ativo TINYINT(1) DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE setores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  nome VARCHAR(80) NOT NULL,
  prefixo VARCHAR(5) NOT NULL,
  ativo TINYINT(1) DEFAULT 1,
  ordem INT DEFAULT 0,
  FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);

CREATE TABLE locais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  nome VARCHAR(80) NOT NULL,
  ativo TINYINT(1) DEFAULT 1,
  FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT,
  nome VARCHAR(100) NOT NULL,
  login VARCHAR(50) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('admin_global','admin_unidade','atendente','medico','triagem','relatorios') DEFAULT 'atendente',
  ativo TINYINT(1) DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);

CREATE TABLE dispositivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  nome VARCHAR(80) NOT NULL,
  tipo ENUM('painel','totem') NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  ativo TINYINT(1) DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);

CREATE TABLE senhas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  setor_id INT NOT NULL,
  numero INT NOT NULL,
  prefixo VARCHAR(5) NOT NULL,
  codigo VARCHAR(10) GENERATED ALWAYS AS (CONCAT(prefixo, LPAD(numero,3,'0'))) STORED,
  tipo ENUM('normal','prioritario') DEFAULT 'normal',
  status ENUM('aguardando','chamada','atendimento','concluido','cancelado') DEFAULT 'aguardando',
  local_id INT,
  usuario_id INT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  chamado_em DATETIME,
  concluido_em DATETIME,
  FOREIGN KEY (unidade_id) REFERENCES unidades(id),
  FOREIGN KEY (setor_id) REFERENCES setores(id),
  FOREIGN KEY (local_id) REFERENCES locais(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Sequência de números por unidade+setor por dia
CREATE TABLE seq_senhas (
  unidade_id INT NOT NULL,
  setor_id INT NOT NULL,
  data DATE NOT NULL,
  ultimo INT DEFAULT 0,
  PRIMARY KEY (unidade_id, setor_id, data)
);

-- Dados iniciais
INSERT INTO unidades (nome, codigo) VALUES ('Clínica Principal', 'U01');

INSERT INTO setores (unidade_id, nome, prefixo, ordem) VALUES
  (1, 'Financeiro', 'FI', 1),
  (1, 'Faturamento', 'FA', 2),
  (1, 'Recepção', 'RC', 3);

INSERT INTO locais (unidade_id, nome) VALUES
  (1, 'Guichê 01'),
  (1, 'Guichê 02'),
  (1, 'Consultório 01');

-- senha: Admin@123
INSERT INTO usuarios (unidade_id, nome, login, senha_hash, perfil) VALUES
  (1, 'Administrador', 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin_global');
