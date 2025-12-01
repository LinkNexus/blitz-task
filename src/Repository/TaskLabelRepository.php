<?php

namespace App\Repository;

use App\Entity\TaskLabel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\String\Slugger\SluggerInterface;

/**
 * @extends ServiceEntityRepository<TaskLabel>
 */
class TaskLabelRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private readonly SluggerInterface $slugger)
    {
        parent::__construct($registry, TaskLabel::class);
    }

    /**
     * Search for a label by its slug.
     *
     * @param string $slug The name to slugify and search for
     * @return ?TaskLabel The found TaskLabel or null if not found
     */
    public function findOneBySlug($slug)
    {
        return $this->findOneBy(['slug' => $this->slugger->slug($slug)->lower()->toString()]);
    }

    /**
     * Find labels by a query.
     * @param string $query
     * @param int $limit
     * @param int $offset
     * @return TaskLabel[]
     */
    public function findAllByQuery(string $query, int $limit = 10, int $offset = 0): array
    {
        return $this->createQueryBuilder("l")
            ->where("ILIKE(l.name, :query) = true")
            ->orWhere("ILIKE(l.slug, :query) = true")
            ->setParameter("query", "%$query%")
            ->orderBy("l.name", "ASC")
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    //    /**
    //     * @return TaskLabel[] Returns an array of TaskLabel objects
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

    //    public function findOneBySomeField($value): ?TaskLabel
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
