<?php

namespace App\EventSubscriber;

use App\Entity\Task;
use App\Entity\Team;
use App\Enum\TaskPriority;
use App\Event\SendVerificationMailEvent;
use App\Event\TeamCreatedEvent;
use App\Event\UserCreatedEvent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

final readonly class UserCreationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EventDispatcherInterface $eventDispatcher,
        private EntityManagerInterface   $entityManager,
    )
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            UserCreatedEvent::class => [
                ["sendVerificationEmail", 10],
                ["createDefaults", 20],
            ]
        ];
    }

    public function sendVerificationEmail(UserCreatedEvent $event): void
    {
        $this->eventDispatcher->dispatch(new SendVerificationMailEvent($event->user));
    }

    public function createDefaults(UserCreatedEvent $event): void
    {
        $user = $event->user;

        $defaultTeam = new Team()
            ->setName($user->getName())
            ->setIsDefault(true)
            ->addMember($user)
            ->addAdmin($user)
            ->setCreator($user);
        $this->entityManager->persist($defaultTeam);
        $this->entityManager->flush();

        $this->eventDispatcher->dispatch(new TeamCreatedEvent(
            $defaultTeam,
            new Task()
                ->setName("Welcome to Blitz-Task!")
                ->setDescription("Welcome to Blitz-Task! This is your first task. You can add more tasks to your team by clicking on the \"+\" button in the top right corner of the screen.")
                ->setPriority(TaskPriority::LOW)
                ->setScore(100)
        ));
    }
}
