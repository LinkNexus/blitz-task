<?php

namespace App\Event;

use App\Entity\Project;

class ProjectCreatedEvent
{
    public function __construct(
        public Project $project,
    ) {}
}
