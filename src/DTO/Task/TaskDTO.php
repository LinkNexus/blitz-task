<?php

namespace App\DTO\Task;

use App\Enum\TaskPriority;
use Symfony\Component\Validator\Constraints as Assert;

class TaskDTO
{
    #[Assert\NotBlank(message: "The name field cannot be empty.")]
    public string $name;

    public ?string $description = null;

    public TaskPriority $priority = TaskPriority::MEDIUM;

    #[Assert\DateTime(format: "Y-m-d\TH:i:s.v\Z", message: "The dueAt property must be in a valid date-time format.")]
    public ?string $dueAt = null;

    /** @var string[] */
    public array $labelIds = [];

    /** @var string[] */
    public array $assigneeIds = [];

    #[Assert\NotBlank(message: "The column field cannot be empty.")]
    public int $columnId;

    public ?float $score = null;
}
