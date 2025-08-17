<?php

namespace App\Repository;

use App\Entity\Task;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Task>
 */
class TaskRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Task::class);
    }

    public function findHighestTaskScore(int $columnId): int
    {
        $result = $this->createQueryBuilder('t')
            ->select('MAX(t.score)')
            ->andWhere('t.relatedColumn = :columnId')
            ->setParameter('columnId', $columnId)
            ->getQuery()
            ->getSingleScalarResult();

        return $result !== null ? (int)$result : 0;
    }

    /**
     * Find a task with its project and team
     * @param int $id The task id
     * @return Task|null The task with its project and team
     */
    public function findWithTeam(int $id): ?Task
    {
        return $this->createQueryBuilder("task")
            ->leftJoin("task.project", "project")
            ->addSelect("project")
            ->leftJoin("project.team", "team")
            ->addSelect("team")
            ->andWhere("task.id = :taskId")
            ->setParameter("taskId", $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    //    /**
    //     * @return Task[] Returns an array of Task objects
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

    //    public function findOneBySomeField($value): ?Task
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
