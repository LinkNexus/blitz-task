<?php

namespace App\EventSubscriber;

use App\Entity\Project;
use App\Entity\Task;
use App\Entity\TaskColumn;
use App\Entity\TaskLabel;
use App\Entity\Team;
use App\Enum\TaskPriority;
use App\Event\SendVerificationMailEvent;
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

        $defaultProject = new Project()
            ->setName($user->getName())
            ->setIsDefault(true)
            ->setTeam($defaultTeam);
        $this->entityManager->persist($defaultProject);

        $colors = [
            "#007bff",
            "#28a745",
            "#ffc107",
            "#dc3545",
        ];
        foreach (["To Do", "In Progress", "Review", "Done"] as $index => $c) {
            $column = new TaskColumn()
                ->setName($c)
                ->setScore($index * 1000)
                ->setColor($colors[$index])
                ->setProject($defaultProject);

            if ($c === "To Do") {
                $label = $this->entityManager->getRepository(TaskLabel::class)
                    ->findBySlug("First Steps");

                if (null === $label) {
                    $label = new TaskLabel()
                        ->setName("First Steps")
                        ->setSlug("first-steps");
                    $this->entityManager->persist($label);
                }

                $task = new Task()
                    ->setName("Welcome to Blitz-Task!")
                    ->setDescription("This is your first task. You can add more tasks by clicking on the + button in the top right corner.")
                    ->setPosition(1)
                    ->setPriority(TaskPriority::LOW)
                    ->addAssignee($user)
                    ->addLabel($label)
                    ->setRelatedColumn($column);
                $this->entityManager->persist($task);
            }

            $this->entityManager->persist($column);
        }

        $this->entityManager->flush();
    }
}
