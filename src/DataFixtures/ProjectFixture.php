<?php

namespace App\DataFixtures;

use App\Entity\Project;
use App\Entity\User;
use App\Event\ProjectCreatedEvent;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;

class ProjectFixture extends Fixture implements DependentFixtureInterface
{
    public function __construct(
        private readonly EventDispatcherInterface $eventDispatcher,
    ) {}

    public function load(ObjectManager $manager): void
    {
        $mainUser = $this->getReference(UserFixture::MAIN_USER_REFERENCE, User::class);
        $faker = Factory::create();

        if (! ($mainUser instanceof User)) {
            return;
        }

        $project = new Project()
            ->setName('Main Project')
            ->setDescription('
- Link to the wiki: <https://wikipedia.org>
- Link to moodle: <https://moodle.org>

This is the main project.
        ')
            ->setCreatedBy($mainUser)
            ->addParticipant($mainUser)
            ->setIcon('📚')
            ->setImage('perplexity.png');

        $allUsers = $manager->getRepository(User::class)
            ->findAll();

        $members = array_filter(
            array_map(
                fn (int $id) => array_find($allUsers, fn (User $user) => $user->getId() === $id),
                $faker->randomElements(
                    array_map(fn (User $user) => $user->getId(), $allUsers),
                    10
                )
            ),
            fn (mixed $user) => $user instanceof User && $user->getId() !== $mainUser->getId()
        );

        array_walk($members, fn (User $user) => $project->addParticipant($user));

        $manager->persist($project);
        $this->eventDispatcher->dispatch(new ProjectCreatedEvent($project));
        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [
            UserFixture::class,
        ];
    }
}
