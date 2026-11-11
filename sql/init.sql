SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS clinicasga CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinicasga;
SET time_zone = '-03:00';

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
  status ENUM('aguardando','chamada','atendimento','concluido','cancelado','nao_compareceu') DEFAULT 'aguardando',
  local_id INT,
  usuario_id INT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  chamado_em DATETIME(3),
  concluido_em DATETIME,
  criado_dia DATE GENERATED ALWAYS AS (DATE(criado_em)) STORED,
  UNIQUE KEY uk_senha_dia (unidade_id, setor_id, criado_dia, numero),
  KEY idx_fila (unidade_id, status, criado_em),
  KEY idx_chamado (unidade_id, chamado_em),
  KEY idx_usuario (usuario_id, status),
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

-- O usuário admin NÃO é criado aqui: a API cria na primeira subida
-- usando a variável ADMIN_SENHA_INICIAL do .env.

CREATE TABLE IF NOT EXISTS configuracoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL UNIQUE,
  clinica_nome VARCHAR(100) DEFAULT 'Clinica',
  papel ENUM('58mm','80mm') DEFAULT '80mm',
  impressao ENUM('dialogo','botao','sem') DEFAULT 'dialogo',
  logo_base64 LONGTEXT,
  tema VARCHAR(20) DEFAULT 'escuro',
  fundo_tipo VARCHAR(20) DEFAULT 'cor',
  fundo_valor VARCHAR(2000) DEFAULT '#0a1628',
  clima_cidade VARCHAR(100) DEFAULT 'Sao Paulo',
  painel_layout VARCHAR(20) DEFAULT 'horizontal',
  voz_opcoes VARCHAR(200) DEFAULT 'codigo,setor,local',
  FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);
INSERT IGNORE INTO configuracoes (unidade_id, clinica_nome) VALUES (1, 'Clinica Principal');
