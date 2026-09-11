import type {
  Channel,
  DepthModePayload,
  ExtractionJobPayload,
  FilePriority,
  FileStatus,
  QueueStrategy,
} from '../types';

function depthModePayload(channel: Channel): DepthModePayload {
  if (channel.depthMode === 'flatten') {
    const depth = Number.isFinite(channel.depth) ? Math.max(0, Math.min(32, Math.floor(channel.depth))) : 0;
    return { type: 'flatten', depth };
  }
  if (channel.depthMode === 'skipOuter') return { type: 'skipOuter' };
  return { type: 'preserve' };
}

interface PrioritizedJob {
  priority: FilePriority;
  job: ExtractionJobPayload;
}

function channelJobs(channel: Channel, statuses: ReadonlySet<FileStatus>, usePriority: boolean): PrioritizedJob[] {
  return channel.files
    .filter((file) => file.supported && statuses.has(file.status))
    .map((file) => ({
      priority: usePriority ? file.priority || 'normal' : 'normal',
      job: {
        jobId: file.id,
        channelId: channel.id,
        archivePath: file.path,
        destination: channel.destination,
        useArchiveDirectory: channel.useArchiveDirectory,
        createArchiveSubfolder: channel.createArchiveSubfolder,
        deduplicateArchiveRoot: channel.deduplicateArchiveRoot,
        collisionPolicy: channel.collisionPolicy,
        depthMode: depthModePayload(channel),
        password: channel.password || undefined,
        openAfter: channel.openAfter,
        skipJunkFiles: channel.skipJunkFiles,
        keepEmptyDirectories: channel.keepEmptyDirectories,
      },
    }));
}

function scheduleQueues(queues: ExtractionJobPayload[][], strategy: QueueStrategy): ExtractionJobPayload[] {
  const nonEmpty = queues.filter((queue) => queue.length > 0);
  if (strategy === 'channelOrder') return nonEmpty.flat();

  const result: ExtractionJobPayload[] = [];
  const longest = Math.max(0, ...nonEmpty.map((queue) => queue.length));
  for (let index = 0; index < longest; index += 1) {
    for (const queue of nonEmpty) {
      const job = queue[index];
      if (job) result.push(job);
    }
  }
  return result;
}

export function buildJobs(
  channels: Channel[],
  strategy: QueueStrategy,
  statuses: FileStatus[] = ['pending', 'error', 'cancelled'],
  usePriority = true,
): ExtractionJobPayload[] {
  const allowed = new Set(statuses);
  const channelQueues = channels.map((channel) => channelJobs(channel, allowed, usePriority));
  const priorities: FilePriority[] = ['high', 'normal', 'low'];

  // Priority is global: every high-priority job is scheduled before normal and low jobs.
  // Within each priority tier, the chosen channel-order or round-robin strategy is preserved.
  return priorities.flatMap((priority) =>
    scheduleQueues(
      channelQueues.map((queue) => queue.filter((entry) => entry.priority === priority).map((entry) => entry.job)),
      strategy,
    ),
  );
}
