-- Migração para instalações já existentes (o init.sql só roda com volume vazio).
-- Rodar UMA vez, antes de subir a nova versão da API:
--   docker compose exec -T mysqldb sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" clinicasga' < sql/migrations/001_melhorias.sql

SET NAMES utf8mb4;
SET time_zone = '-03:00';

ALTER TABLE senhas
  MODIFY chamado_em DATETIME(3) NULL,
  ADD COLUMN criado_dia DATE GENERATED ALWAYS AS (DATE(criado_em)) STORED,
  ADD KEY idx_fila (unidade_id, status, criado_em),
  ADD KEY idx_chamado (unidade_id, chamado_em),
  ADD KEY idx_usuario (usuario_id, status);

-- A numeração passou do Redis para a tabela seq_senhas.
-- Sincroniza com o maior número já emitido hoje para não repetir senhas no dia da migração.
INSERT INTO seq_senhas (unidade_id, setor_id, data, ultimo)
  SELECT unidade_id, setor_id, CURDATE(), MAX(numero)
  FROM senhas
  WHERE criado_em >= CURDATE()
  GROUP BY unidade_id, setor_id
ON DUPLICATE KEY UPDATE ultimo = GREATEST(ultimo, VALUES(ultimo));

-- Garantia de que nunca haverá senha repetida no mesmo dia.
-- Com o bug antigo (reset às 21h / perda no Redis) podem existir duplicadas no histórico.
-- Verifique antes:
--   SELECT unidade_id, setor_id, criado_dia, numero, COUNT(*) c FROM senhas
--   GROUP BY 1,2,3,4 HAVING c > 1;
-- Se não retornar nada, aplique:
--   ALTER TABLE senhas ADD UNIQUE KEY uk_senha_dia (unidade_id, setor_id, criado_dia, numero);
