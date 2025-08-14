import {useAppStore} from "@/lib/store.ts";
import {useSearchParams} from "wouter";
import {useEffect} from "react";

export function useParamsNavigation() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId");
  const teamId = params.get("teamId");
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    activeProjectId,
    setActiveProjectId
  } = useAppStore(state => state);
  const defaultTeam = teams.find(t => t.isDefault);
  const defaultProject = defaultTeam?.projects?.find(p => p.isDefault);

  useEffect(() => {
    if (!activeTeamId && !teamId && defaultTeam) {
      setActiveTeamId(defaultTeam.id);
    }
  }, [activeTeamId, defaultTeam, teamId]);

  useEffect(() => {
    if (defaultTeam?.id === activeTeamId && !activeProjectId && defaultProject) {
      setActiveProjectId(defaultProject.id);
    }
  }, [activeProjectId, defaultTeam?.id, activeTeamId, defaultProject])

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
    if (activeProjectId) {
      setParams(prev => {
        prev.set("projectId", activeProjectId.toString());
        return prev;
      })
    } else if (!activeProjectId && projectId) {
      setActiveProjectId(parseInt(projectId));
    }
  }, [activeTeamId, defaultTeam?.id, activeProjectId, projectId]);
}
