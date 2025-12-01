<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251129161738 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE task DROP CONSTRAINT fk_527edb25166d1f9c');
        $this->addSql('DROP INDEX idx_527edb25166d1f9c');
        $this->addSql('ALTER TABLE task DROP project_id');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE task ADD project_id INT NOT NULL');
        $this->addSql('ALTER TABLE task ADD CONSTRAINT fk_527edb25166d1f9c FOREIGN KEY (project_id) REFERENCES project (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX idx_527edb25166d1f9c ON task (project_id)');
    }
}
