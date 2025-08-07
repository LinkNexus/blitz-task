<?php

namespace App\DTO;

use App\Enum\TaskPriority;
use Symfony\Component\Validator\Constraints as Assert;

class TaskDTO
{
    #[Assert\NotBlank(message: "The name field cannot be empty.")]
    public string $name;

    public ?string $description = null;

    public TaskPriority $priority = TaskPriority::MEDIUM;

    #[Assert\DateTime(message: "The dueAt property must be in a valid date-time format.")]
    public ?string $dueAt = null;

    /** @var string[] */
    public array $labels = [];

    #[Assert\NotBlank(message: "The column field cannot be empty.")]
    public int $column;

    #[Assert\NotBlank(message: "The score field cannot be empty.")]
    public float $score;
}
