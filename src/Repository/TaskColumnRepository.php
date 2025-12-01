<?php

namespace App\Repository;

use App\Entity\TaskColumn;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TaskColumn>
 */
class TaskColumnRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TaskColumn::class);
    }

    /**
     * Get a column with its project.
     * @param int $columnId The id of the column to find
     * @return TaskColumn|null The found column or null if not found
     */
    public function findWithProject(int $columnId): ?TaskColumn
    {
        return $this->createQueryBuilder('c')
            ->leftJoin("c.project", "p")
            ->addSelect("p")
            ->where("c.id = :columnId")
            ->setParameter("columnId", $columnId)
            ->getQuery()
            ->getOneOrNullResult();
    }

//    /**
//     * @return TaskColumn[] Returns an array of TaskColumn objects
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

//    public function findOneBySomeField($value): ?TaskColumn
//    {
//        return $this->createQueryBuilder('t')
//            ->andWhere('t.exampleField = :val')
//            ->setParameter('val', $value)
//            ->getQuery()
//            ->getOneOrNullResult()
//        ;
//    }
}
