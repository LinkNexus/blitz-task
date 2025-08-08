import {useAppStore} from "@/lib/store.ts";
import {useSearchParams} from "wouter";
import {useApiFetch} from "@/hooks/use-fetch.ts";
import type {Project, Team} from "@/types.ts";
import {toast} from "sonner";
import {useEffect} from "react";

export function useParamsNavigation() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId");
  const teamId = params.get("teamId");
  const {
    setDefaultTeam,
    defaultTeam,
    activeTeamId,
    setActiveTeamId,
    activeProjectId,
    setActiveProjectId
  } = useAppStore(state => state);

  const {
    callback: fetchTeam
  } = useApiFetch("/api/teams/default", {
    onSuccess(team: Team) {
      setActiveTeamId(team.id);
      setDefaultTeam(team);
    },
    onError() {
      toast.error("An error happened when getting the active team, reload the page to clear this error.");
    }
  });

  const {
    callback: fetchProject
  } = useApiFetch("/api/projects/default", {
    onSuccess(project: Project) {
      setParams((prev) => {
        prev.set("projectId", project.id.toString());
        return prev;
      })
    },
    onError() {
      toast.error("An error happened when getting the active project, reload the page to clear this error.");
    }
  });

  useEffect(() => {
    if (!activeTeamId || !defaultTeam) {
      fetchTeam();
    }
  }, [activeTeamId, defaultTeam]);

  useEffect(() => {
    if (defaultTeam?.id === activeTeamId && !activeProjectId) {
      fetchProject();
    }
  }, [activeProjectId, defaultTeam?.id, activeTeamId])

  useEffect(() => {
    if (activeTeamId) {
      setParams(prev => {
        prev.set("teamId", activeTeamId.toString());
        return prev;
      })
    } else if (teamId) {
      setActiveTeamId(parseInt(teamId));
    }
  }, [activeTeamId, teamId]);

  useEffect(() => {
    if (activeProjectId && defaultTeam?.id === activeTeamId) {
      setParams(prev => {
        prev.set("projectId", activeProjectId.toString());
        return prev;
      })
    } else if (!activeProjectId && projectId) {
      setActiveProjectId(parseInt(projectId));
    }
  }, [activeTeamId, defaultTeam?.id, activeProjectId, projectId]);

  return {
    activeTeamId
  }
}
