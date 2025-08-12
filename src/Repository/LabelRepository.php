<?php

namespace App\Repository;

use App\Entity\Label;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\String\Slugger\SluggerInterface;

/**
 * @extends ServiceEntityRepository<Label>
 */
class LabelRepository extends ServiceEntityRepository
{
    public function __construct(
        ManagerRegistry                   $registry,
        private readonly SluggerInterface $slugger
    )
    {
        parent::__construct($registry, Label::class);
    }

    /**
     * Search a label by its slug
     * @param string $name The name of the label
     * @return ?Label The entity instance or null if not found
     */
    public function findOneBySlug(string $name): ?Label
    {
        return $this->findOneBy([
            'slug' => $this->slugger->slug($name)->lower()->toString()
        ]);
    }

    //    /**
    //     * @return Label[] Returns an array of Label objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('t.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Label
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
