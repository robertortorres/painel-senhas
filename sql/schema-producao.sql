-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: clinicasga
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `configuracoes`
--

DROP TABLE IF EXISTS `configuracoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int NOT NULL,
  `clinica_nome` varchar(100) DEFAULT 'Clinica',
  `papel` enum('58mm','80mm') DEFAULT '80mm',
  `impressao` enum('dialogo','botao','sem') DEFAULT 'dialogo',
  `logo_base64` longtext,
  `tema` varchar(20) DEFAULT 'escuro',
  `fundo_tipo` varchar(20) DEFAULT 'cor',
  `fundo_valor` varchar(255) DEFAULT '#0a1628',
  `clima_cidade` varchar(100) DEFAULT 'Sao Paulo',
  `painel_layout` varchar(20) DEFAULT 'horizontal',
  `voz_opcoes` varchar(200) DEFAULT 'codigo,setor,local',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unidade_id` (`unidade_id`),
  CONSTRAINT `configuracoes_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dispositivos`
--

DROP TABLE IF EXISTS `dispositivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dispositivos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int NOT NULL,
  `nome` varchar(80) NOT NULL,
  `tipo` enum('painel','totem') NOT NULL,
  `token` varchar(64) NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `unidade_id` (`unidade_id`),
  CONSTRAINT `dispositivos_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `locais`
--

DROP TABLE IF EXISTS `locais`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locais` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int NOT NULL,
  `nome` varchar(80) NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `unidade_id` (`unidade_id`),
  CONSTRAINT `locais_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `senhas`
--

DROP TABLE IF EXISTS `senhas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `senhas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int NOT NULL,
  `setor_id` int NOT NULL,
  `numero` int NOT NULL,
  `prefixo` varchar(5) NOT NULL,
  `codigo` varchar(10) GENERATED ALWAYS AS (concat(`prefixo`,lpad(`numero`,3,_utf8mb4'0'))) STORED,
  `tipo` enum('normal','prioritario') DEFAULT 'normal',
  `status` enum('aguardando','chamada','atendimento','concluido','cancelado') DEFAULT 'aguardando',
  `local_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  `chamado_em` datetime DEFAULT NULL,
  `concluido_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `unidade_id` (`unidade_id`),
  KEY `setor_id` (`setor_id`),
  KEY `local_id` (`local_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `senhas_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`),
  CONSTRAINT `senhas_ibfk_2` FOREIGN KEY (`setor_id`) REFERENCES `setores` (`id`),
  CONSTRAINT `senhas_ibfk_3` FOREIGN KEY (`local_id`) REFERENCES `locais` (`id`),
  CONSTRAINT `senhas_ibfk_4` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=635 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `seq_senhas`
--

DROP TABLE IF EXISTS `seq_senhas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seq_senhas` (
  `unidade_id` int NOT NULL,
  `setor_id` int NOT NULL,
  `data` date NOT NULL,
  `ultimo` int DEFAULT '0',
  PRIMARY KEY (`unidade_id`,`setor_id`,`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `setores`
--

DROP TABLE IF EXISTS `setores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `setores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int NOT NULL,
  `nome` varchar(80) NOT NULL,
  `prefixo` varchar(5) NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `ordem` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `unidade_id` (`unidade_id`),
  CONSTRAINT `setores_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unidades`
--

DROP TABLE IF EXISTS `unidades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unidades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `codigo` varchar(20) NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidade_id` int DEFAULT NULL,
  `nome` varchar(100) NOT NULL,
  `login` varchar(50) NOT NULL,
  `senha_hash` varchar(255) NOT NULL,
  `perfil` enum('admin_global','admin_unidade','atendente','medico','triagem','relatorios') DEFAULT 'atendente',
  `ativo` tinyint(1) DEFAULT '1',
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `login` (`login`),
  KEY `unidade_id` (`unidade_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`unidade_id`) REFERENCES `unidades` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'clinicasga'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
