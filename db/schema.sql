
CREATE DATABASE where2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE where2;


CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,              -- bcrypt hash, never plain text
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

--  CATEGORIES  (study area, computer lab, printer, cafeteria)

CREATE TABLE categories (
  id               TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(30)  NOT NULL,            -- e.g. 'study_area'
  name             VARCHAR(60)  NOT NULL,            -- e.g. 'Study Area'
  condition_label  VARCHAR(60)  NOT NULL,            -- question shown on the form, e.g. 'Noise level'
  CONSTRAINT uq_categories_code UNIQUE (code)
) ENGINE=InnoDB;

--  CONDITION OPTIONS 

CREATE TABLE condition_options (
  id           SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id  TINYINT UNSIGNED NOT NULL,
  code         VARCHAR(30)  NOT NULL,                -- e.g. 'quiet'
  label        VARCHAR(60)  NOT NULL,                -- e.g. 'Quiet'
  score        TINYINT UNSIGNED NOT NULL,            -- 0..100
  sort_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT uq_condition_per_category UNIQUE (category_id, code),
  -- lets reports reference (condition, category) together, see reports table
  CONSTRAINT uq_condition_id_category  UNIQUE (id, category_id),
  CONSTRAINT chk_condition_score CHECK (score <= 100),
  CONSTRAINT fk_condition_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;


--  RESOURCES  (spec #3)

CREATE TABLE resources (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  category_id  TINYINT UNSIGNED NOT NULL,
  building     VARCHAR(100) NOT NULL,               
  floor        VARCHAR(30)  NULL,
  description  TEXT         NULL,
  capacity     SMALLINT UNSIGNED NULL,             
  features     VARCHAR(255) NULL,                    
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,        -- admins deactivate instead of deleting
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_resource_name UNIQUE (name),
  CONSTRAINT uq_resource_id_category UNIQUE (id, category_id),
  CONSTRAINT fk_resource_category FOREIGN KEY (category_id)
    REFERENCES categories(id),
  INDEX idx_resources_category (category_id, is_active),
  INDEX idx_resources_building (building)
) ENGINE=InnoDB;


--  REPORTS  

CREATE TABLE reports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  resource_id   INT UNSIGNED NOT NULL,
  category_id   TINYINT UNSIGNED NOT NULL,
  condition_id  SMALLINT UNSIGNED NOT NULL,
  comment       VARCHAR(500) NULL,               
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
  is_hidden     BOOLEAN NOT NULL DEFAULT FALSE,    
  moderated_by  INT UNSIGNED NULL,
  moderated_at  TIMESTAMP NULL,
  CONSTRAINT fk_report_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_resource FOREIGN KEY (resource_id, category_id)
    REFERENCES resources(id, category_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_condition FOREIGN KEY (condition_id, category_id)
    REFERENCES condition_options(id, category_id),
  CONSTRAINT fk_report_moderator FOREIGN KEY (moderated_by)
    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reports_resource_time (resource_id, created_at),
  INDEX idx_reports_user_resource_time (user_id, resource_id, created_at),  
  INDEX idx_reports_time (created_at)                                       -- dashboard
) ENGINE=InnoDB;


--  REPORT VOTES  

CREATE TABLE report_votes (
  user_id     INT UNSIGNED NOT NULL,
  report_id   INT UNSIGNED NOT NULL,
  vote        ENUM('confirm','dispute') NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, report_id),
  CONSTRAINT fk_vote_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_report FOREIGN KEY (report_id)
    REFERENCES reports(id) ON DELETE CASCADE,
  INDEX idx_votes_report (report_id, vote)
) ENGINE=InnoDB;


--  Safety net: block self-voting in the database too.


DELIMITER $$

CREATE TRIGGER trg_no_self_vote_insert
BEFORE INSERT ON report_votes
FOR EACH ROW
BEGIN
  IF (SELECT user_id FROM reports WHERE id = NEW.report_id) = NEW.user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Users cannot vote on their own report';
  END IF;
END$$

CREATE TRIGGER trg_no_self_vote_update
BEFORE UPDATE ON report_votes
FOR EACH ROW
BEGIN
  IF (SELECT user_id FROM reports WHERE id = NEW.report_id) = NEW.user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Users cannot vote on their own report';
  END IF;
END$$

DELIMITER ;

