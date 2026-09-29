'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Search, 
  Layers, 
  Video, 
  Flame, 
  Activity, 
  RefreshCw,
  Lightbulb,
  Vote,
  LayoutGrid,
  List,
  MessageSquare
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { IngestModal } from '@/components/IngestModal';
import { IdeaCard } from '@/components/IdeaCard';
import { CompactIdeaRow } from '@/components/CompactIdeaRow';
import { IdeaDetailModal } from '@/components/IdeaDetailModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { RepliesModal } from '@/components/RepliesModal';
import { StoryValidationModal } from '@/components/StoryValidationModal';
import { InsightsView } from '@/components/InsightsView';
import { CalendarView } from '@/components/CalendarView';
import { RepliesView } from '@/components/RepliesView';
import { api } from '@/lib/api';
import { 
  Idea, 
  Cluster, 
  InsightsResponse, 
  CalendarEvent, 
  JobStatus, 
  IdeaStatus 
} from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'board' | 'insights' | 'calendar' | 'replies' | 'ingest'>('board');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View mode: 'grid' or 'list' for concise scanning
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gapFilter, setGapFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');

  // Modals
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<Idea | null>(null);
  const [schedulingIdea, setSchedulingIdea] = useState<Idea | null>(null);
  const [repliesIdea, setRepliesIdea] = useState<Idea | null>(null);
  const [storyValidationIdea, setStoryValidationIdea] = useState<Idea | null>(null);

  // Pipeline Job state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      const [ideasData, clustersData, insightsData, calendarData] = await Promise.all([
        api.getIdeas(),
        api.getClusters(),
        api.getInsights(),
        api.getCalendar()
      ]);
      setIdeas(ideasData);
      setClusters(clustersData);
      setInsights(insightsData);
      setCalendarEvents(calendarData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll Job Progress when a job is active
  useEffect(() => {
    if (!activeJobId) return;

    let intervalId: NodeJS.Timeout;
    const pollJob = async () => {
      try {
        const res = await api.getJobStatus(activeJobId);
        setJobStatus(res);
        if (res.status === 'completed') {
          setIsAnalyzing(false);
          setActiveJobId(null);
          fetchData();
        } else if (res.status === 'failed') {
          setIsAnalyzing(false);
          setActiveJobId(null);
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    };

    setIsAnalyzing(true);
    pollJob();
    intervalId = setInterval(pollJob, 2000);
    return () => clearInterval(intervalId);
  }, [activeJobId, fetchData]);

  // Start analysis trigger
  const handleQuickAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await api.startAnalysis();
      setActiveJobId(res.job_id);
    } catch (err) {
      console.error('Analysis trigger failed:', err);
      setIsAnalyzing(false);
    }
  };

  const handleAnalysisStarted = (jobId: string) => {
    setIsIngestOpen(false);
    setActiveJobId(jobId);
    setIsAnalyzing(true);
  };

  const handleStatusChange = async (ideaId: string, status: IdeaStatus) => {
    try {
      const updated = await api.updateIdeaStatus(ideaId, status);
      setIdeas((prev) => prev.map((item) => (item.id === ideaId ? updated : item)));
      if (selectedDetailIdea && selectedDetailIdea.id === ideaId) {
        setSelectedDetailIdea(updated);
      }
      if (status === 'planned' || status === 'posted') {
        const cal = await api.getCalendar();
        setCalendarEvents(cal);
      }
    } catch (err) {
      console.error('Failed to update idea status:', err);
    }
  };

  // Filter ideas logic
  const filteredIdeas = ideas.filter((idea) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = idea.title.toLowerCase().includes(q);
      const matchHook = idea.hook.toLowerCase().includes(q);
      const matchCluster = (idea.cluster_name || '').toLowerCase().includes(q);
      const matchComments = idea.evidence_comments?.some((c) =>
        (c.clean_text || c.text).toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchHook && !matchCluster && !matchComments) {
        return false;
      }
    }

    if (statusFilter === 'high_demand' && idea.demand_score < 60) return false;
    if (statusFilter === 'saved' && idea.status !== 'saved' && idea.status !== 'planned' && idea.status !== 'posted') return false;
    if (statusFilter === 'planned' && idea.status !== 'planned') return false;
    if (statusFilter === 'posted' && idea.status !== 'posted') return false;

    if (gapFilter === 'new_opportunity' && idea.gap_status !== 'new_opportunity') return false;
    if (gapFilter === 'already_covered' && idea.gap_status !== 'already_covered') return false;

    if (clusterFilter !== 'all' && idea.cluster_id.toString() !== clusterFilter) return false;

    if (formatFilter !== 'all' && (idea.format || '').toLowerCase() !== formatFilter.toLowerCase()) return false;

    return true;
  });

  const reelsCount = ideas.filter((i) => (i.format || '').toLowerCase() === 'reel').length;
  const carouselsCount = ideas.filter((i) => (i.format || '').toLowerCase() === 'carousel').length;
  const storiesCount = ideas.filter((i) => (i.format || '').toLowerCase() === 'story').length;
  const topIdea = ideas.length > 0 ? ideas[0] : null;

  return (
    <div className="min-h-screen bg-[#F8FAF8] dark:bg-[#0D1510] text-[#152218] dark:text-[#F3F8F4] transition-colors">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(t) => {
          if (t === 'ingest') {
            setIsIngestOpen(true);
          } else {
            setActiveTab(t);
          }
        }}
        onOpenIngest={() => setIsIngestOpen(true)}
        onQuickAnalyze={handleQuickAnalyze}
        isAnalyzing={isAnalyzing}
        jobProgress={jobStatus?.progress || 0}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Job Progress Banner */}
        {isAnalyzing && jobStatus && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#141E17] border border-[#CDE9D5] dark:border-slate-800 shadow-xs animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#3B8253] text-white flex items-center justify-center animate-spin">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#152218] dark:text-white">
                    {jobStatus.stage}
                  </h4>
                  <p className="text-xs text-[#5C6F62] dark:text-[#8FA596]">
                    Analyzing audience comments for content requests and pain points...
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#3B8253] dark:text-[#6EC886]">
                {jobStatus.progress}% Complete
              </span>
            </div>

            <div className="w-full h-1.5 bg-[#EAF6EE] dark:bg-[#19271E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3B8253] transition-all duration-300 rounded-full"
                style={{ width: `${jobStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* TAB 1: CONCISE IDEA BOARD */}
        {activeTab === 'board' && (
          <div className="space-y-5">
            {/* Concise Header Bar (Simple, scannable, white + pista) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#141E17] border border-[#E2EDE5] dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#152218] dark:text-white">
                    Idea Board
                  </h1>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#EAF6EE] text-[#28663D] border border-[#CDE9D5]">
                    {ideas.length} Ideas
                  </span>
                </div>
                <p className="text-xs text-[#5C6F62] dark:text-[#8FA596] mt-0.5">
                  Ranked Instagram content ideas grounded in verified audience comments.
                </p>
              </div>

              {/* View Switcher & Quick Story Poll for Top Idea */}
              <div className="flex items-center gap-2.5">
                {topIdea && (
                  <button
                    onClick={() => setStoryValidationIdea(topIdea)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EAF6EE] text-[#28663D] hover:bg-[#D5ECDC] border border-[#CDE9D5] transition shadow-xs"
                    title="Validate top idea with Story poll"
                  >
                    <Vote className="w-3.5 h-3.5 text-[#3B8253]" />
                    <span className="hidden sm:inline">Validate Top Idea:</span>
                    <span className="truncate max-w-[130px] font-medium">{topIdea.title}</span>
                  </button>
                )}

                {/* Grid / List View Toggle */}
                <div className="flex items-center bg-[#F4FAF5] dark:bg-[#19271E] p-1 rounded-xl border border-[#E2EDE5] dark:border-slate-800">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-[#141E17] text-[#28663D] shadow-xs'
                        : 'text-[#5C6F62] hover:text-[#152218]'
                    }`}
                    title="Card Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-[#141E17] text-[#28663D] shadow-xs'
                        : 'text-[#5C6F62] hover:text-[#152218]'
                    }`}
                    title="Concise List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Concise Filters & Search Bar */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#141E17] border border-[#E2EDE5] dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Format Pills */}
              <div className="flex items-center gap-1.5 bg-[#F4FAF5] dark:bg-[#19271E] p-1 rounded-xl border border-[#E2EDE5] dark:border-slate-800 w-full md:w-auto overflow-x-auto">
                {[
                  { id: 'all', label: `All (${ideas.length})` },
                  { id: 'reel', label: `🎥 Reels (${reelsCount})` },
                  { id: 'carousel', label: `📸 Carousels (${carouselsCount})` },
                  { id: 'story', label: `🔥 Stories (${storiesCount})` }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setFormatFilter(fmt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      formatFilter === fmt.id
                        ? 'bg-white dark:bg-[#141E17] text-[#28663D] dark:text-[#93DBA6] border border-[#CDE9D5] dark:border-[#2D4C39] shadow-xs'
                        : 'text-[#5C6F62] hover:text-[#152218] dark:text-[#8FA596]'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>

              {/* Search Box & Topic Dropdown */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="relative w-full md:w-72">
                  <Search className="w-3.5 h-3.5 text-[#5C6F62] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ideas or keywords..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-[#F8FAF8] dark:bg-[#19271E] border border-[#E2EDE5] dark:border-slate-800 text-[#152218] dark:text-white placeholder-[#8FA596] focus:outline-none focus:border-[#3B8253]"
                  />
                </div>

                <select
                  value={clusterFilter}
                  onChange={(e) => setClusterFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F8FAF8] dark:bg-[#19271E] border border-[#E2EDE5] dark:border-slate-800 text-[#28663D] dark:text-[#93DBA6] focus:outline-none"
                >
                  <option value="all">All Topics ({clusters.length})</option>
                  {clusters.map((c) => (
                    <option key={c.cluster_id} value={c.cluster_id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={fetchData}
                  className="p-1.5 rounded-xl text-[#5C6F62] hover:text-[#3B8253] hover:bg-[#F4FAF5] border border-[#E2EDE5] transition"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Ideas Presentation: Grid vs List */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-[#EAF6EE]/50 animate-pulse border border-[#E2EDE5]" />
                ))}
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#141E17] rounded-3xl border border-[#E2EDE5] dark:border-slate-800 p-8 space-y-3">
                <Lightbulb className="w-10 h-10 mx-auto text-[#3B8253]" />
                <h3 className="text-base font-bold text-[#152218] dark:text-white">
                  No ideas match your filters
                </h3>
                <p className="text-xs text-[#5C6F62] max-w-sm mx-auto">
                  Try clearing your search query or switching back to &quot;All Formats&quot;.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setGapFilter('all');
                    setClusterFilter('all');
                    setFormatFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3B8253] hover:bg-[#2F6A44] text-white transition shadow-xs"
                >
                  Clear Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* Concise Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onSelectIdea={(i) => setSelectedDetailIdea(i)}
                    onStatusChange={handleStatusChange}
                    onOpenSchedule={(i) => setSchedulingIdea(i)}
                    onOpenStoryValidation={(i) => setStoryValidationIdea(i)}
                  />
                ))}
              </div>
            ) : (
              /* Concise List View */
              <div className="space-y-2.5">
                {filteredIdeas.map((idea) => (
                  <CompactIdeaRow
                    key={idea.id}
                    idea={idea}
                    onSelectIdea={(i) => setSelectedDetailIdea(i)}
                    onStatusChange={handleStatusChange}
                    onOpenSchedule={(i) => setSchedulingIdea(i)}
                    onOpenStoryValidation={(i) => setStoryValidationIdea(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INSIGHTS */}
        {activeTab === 'insights' && (
          <InsightsView insights={insights} isLoading={isLoading} />
        )}

        {/* TAB 3: CALENDAR */}
        {activeTab === 'calendar' && (
          <CalendarView
            events={calendarEvents}
            ideas={ideas}
            onRefresh={fetchData}
            onOpenSchedule={(i) => setSchedulingIdea(i)}
          />
        )}

        {/* TAB 4: REPLIES */}
        {activeTab === 'replies' && (
          <RepliesView />
        )}
      </main>

      {/* MODALS */}
      <IdeaDetailModal
        idea={selectedDetailIdea}
        isOpen={!!selectedDetailIdea}
        onClose={() => setSelectedDetailIdea(null)}
        onStatusChange={handleStatusChange}
        onOpenSchedule={(i) => setSchedulingIdea(i)}
        onOpenStoryValidation={(i) => setStoryValidationIdea(i)}
      />

      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onAnalysisStarted={handleAnalysisStarted}
        activeJob={jobStatus}
      />

      <ScheduleModal
        idea={schedulingIdea}
        isOpen={!!schedulingIdea}
        onClose={() => setSchedulingIdea(null)}
        onScheduled={fetchData}
      />

      <RepliesModal
        idea={repliesIdea}
        isOpen={!!repliesIdea}
        onClose={() => setRepliesIdea(null)}
      />

      <StoryValidationModal
        idea={storyValidationIdea}
        isOpen={!!storyValidationIdea}
        onClose={() => setStoryValidationIdea(null)}
      />
    </div>
  );
}
