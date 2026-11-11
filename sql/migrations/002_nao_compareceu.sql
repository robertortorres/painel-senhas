-- Status "nao_compareceu" para o fechamento diário automático.
-- Rodar UMA vez, ANTES de subir a versão da API que tem o fechamento:
--   docker compose exec -T mysqldb sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" clinicasga' < sql/migrations/002_nao_compareceu.sql
--
-- Ao subir, a API fecha também as sobras de TODOS os dias anteriores (o log mostra quantas).
-- Para ver antes o que vai mudar:
--   SELECT DATE(criado_em) dia, status, COUNT(*) FROM senhas
--   WHERE status IN ('aguardando','chamada','atendimento') AND criado_em < CURDATE()
--   GROUP BY dia, status ORDER BY dia;

ALTER TABLE senhas
  MODIFY status ENUM('aguardando','chamada','atendimento','concluido','cancelado','nao_compareceu') DEFAULT 'aguardando';
