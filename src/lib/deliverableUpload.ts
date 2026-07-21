import { supabase } from './supabase'

const DELIVERABLE_BUCKET = 'deliverable-files'

export async function createDeliverableSignedUrl(storagePath: string): Promise<string | null> {
    if (!supabase) return storagePath
    const { data, error } = await supabase.storage.from(DELIVERABLE_BUCKET).createSignedUrl(storagePath, 60 * 60)
    return error || !data?.signedUrl ? null : data.signedUrl
}
