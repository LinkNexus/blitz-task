<?php

namespace App\Event;

use App\Entity\User;

class UserCreatedEvent
{
    public function __construct(public User $user) {}
}
