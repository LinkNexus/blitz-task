<?php

namespace App\DTO;

use App\Enum\TaskPriority;
use DateTimeImmutable;
use Symfony\Component\Validator\Constraints as Assert;

class TaskDTO
{
    #[Assert\NotBlank(message: 'The name field cannot be empty.')]
    #[Assert\Length(min: 2, max: 255, minMessage: 'The name must be at least {{ limit }} characters long.', maxMessage: 'The name cannot be longer than {{ limit }} characters.')]
    public ?string $name = null;

    public ?string $description = "";

    public TaskPriority $priority = TaskPriority::MEDIUM;

    #[Assert\Positive]
    public int $projectId = 0;

    public array $assigneesIds = [];

    public array $labelsIds = [];

    public ?DateTimeImmutable $dueAt = null;
}
