<?php

namespace App\DataFixtures;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class UserFixture extends Fixture
{
    public function __construct(private readonly UserPasswordHasherInterface $passwordHasher) {}

    public const MAIN_USER_REFERENCE = 'main-user';

    public function load(ObjectManager $manager): void
    {
        $faker = Factory::create();

        $user = new User()
            ->setName('Test User')
            ->setIsVerified(true)
            ->setEmail('test@example.com');
        $user->setPassword($this->passwordHasher->hashPassword($user, 'test'));
        $manager->persist($user);
        $this->addReference(self::MAIN_USER_REFERENCE, $user);

        for ($i = 0; $i < 50; $i++) {
            $user = new User()
                ->setName($faker->name())
                ->setEmail($faker->unique()->email())
                ->setIsVerified($faker->boolean(80));

            $user->setPassword($this->passwordHasher->hashPassword($user, 'test'));
            $manager->persist($user);
        }

        $manager->flush();
    }
}
