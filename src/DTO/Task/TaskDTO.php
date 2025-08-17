<?php

namespace App\DTO\Task;

use App\Enum\TaskPriority;
use Symfony\Component\Validator\Constraints as Assert;

class TaskDTO
{
    #[Assert\NotBlank(
        message: "The name field cannot be empty.",
        allowNull: true,
        normalizer: "trim",
        groups: ["partial_update"]
    )]
    #[Assert\NotNull]
    public ?string $name = null;

    public ?string $description = null;

    public ?TaskPriority $priority = null;

    #[Assert\DateTime(
        format: "Y-m-d\TH:i:s.v\Z",
        message: "The dueAt property must be in a valid date-time format.",
        groups: ["partial_update"]
    )]
    public ?string $dueAt = null;

    /** @var int[] */
    public array $labelIds = [];

    /** @var int[] */
    public array $assigneeIds = [];
}
