<?php

namespace App\Event;

use App\Entity\Task;
use App\Entity\Team;

final readonly class TeamCreatedEvent
{
    public function __construct(public Team $team, public ?Task $defaultTask = null)
    {
    }
}
