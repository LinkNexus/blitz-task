<?php

namespace App\Event;

use App\Entity\User;

readonly class UserCreatedEvent
{
    public function __construct(public User $user)
    {
    }
}
