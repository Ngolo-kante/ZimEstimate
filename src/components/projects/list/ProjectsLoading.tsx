import { Skeleton } from '@/components/shadcn/skeleton';

export default function ProjectsLoading() {
    return <div className="projects-loading" role="status" aria-label="Loading projects">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-6 w-3/4" />
        <div className="projects-grid"><Skeleton className="h-60 rounded-xl" /><Skeleton className="h-60 rounded-xl" /></div>
    </div>;
}
