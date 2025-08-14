<?php

namespace App\Event;

use App\Entity\Project;
use App\Entity\Task;

final readonly class ProjectCreatedEvent
{
    public function __construct(public Project $project, public ?Task $defaultTask = null)
    {
    }
}
