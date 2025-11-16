import { useApiFetch } from "@/hooks/use-api-fetch";
import type { TaskColumn } from "@/types";
import { memo, useEffect, useMemo, useState } from "react";
import { KanbanColumn } from "./kanban-column";

type Props = {
	id: number;
};

export const KanbanBoard = memo(({ id }: Props) => {
	const [columns, setColumns] = useState<TaskColumn[]>([]);

	const sortedColumns = useMemo(() => {
		return [...columns].sort((a, b) => a.score - b.score);
	}, [columns]);

	const { pending: fetchingColumns, action: fetchColumns } = useApiFetch<
		TaskColumn[]
	>({
		url: `/api/columns`,
		options: {
			onSuccess(res) {
				console.log(res.data);
				setColumns(res.data);
			},
		},
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		fetchColumns({ searchParams: { projectId: id } });
	}, [id]);

	if (fetchingColumns) return <div>Loading...</div>;

	return (
		<div className=" mt-6 flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
			{sortedColumns.map((column, idx) => (
				<KanbanColumn key={column.id} column={column} columns={columns} />
			))}
		</div>
	);
});
