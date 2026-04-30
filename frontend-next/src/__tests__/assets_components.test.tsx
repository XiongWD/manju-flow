import { describe, it, expect } from 'vitest'

describe('Assets components import', () => {
    it('AssetFilterBar can be imported', async () => {
        const mod = await import('../app/workspace/assets/components/AssetFilterBar')
        expect(mod).toBeDefined()
    })
    it('AssetList can be imported', async () => {
        const mod = await import('../app/workspace/assets/components/AssetList')
        expect(mod).toBeDefined()
    })
    it('AssetUploadPanel can be imported', async () => {
        const mod = await import('../app/workspace/assets/components/AssetUploadPanel')
        expect(mod).toBeDefined()
    })
    it('AssetPreviewModal can be imported', async () => {
        const mod = await import('../app/workspace/assets/components/AssetPreviewModal')
        expect(mod).toBeDefined()
    })
    it('SceneCascadeSelector can be imported', async () => {
        const mod = await import('../app/workspace/assets/components/SceneCascadeSelector')
        expect(mod).toBeDefined()
    })
})

describe('Delivery components import', () => {
    it('DeliveryPackagesPanel can be imported', async () => {
        const mod = await import('../app/workspace/delivery/components/DeliveryPackagesPanel')
        expect(mod).toBeDefined()
    })
    it('PublishJobsPanel can be imported', async () => {
        const mod = await import('../app/workspace/delivery/components/PublishJobsPanel')
        expect(mod).toBeDefined()
    })
    it('SubtitleEditor can be imported', async () => {
        const mod = await import('../app/workspace/delivery/components/SubtitleEditor')
        expect(mod).toBeDefined()
    })
})

describe('Render components import', () => {
    it('SceneQueueTable can be imported', async () => {
        const mod = await import('../app/workspace/render/components/SceneQueueTable')
        expect(mod).toBeDefined()
    })
    it('JobHistoryTable can be imported', async () => {
        const mod = await import('../app/workspace/render/components/JobHistoryTable')
        expect(mod).toBeDefined()
    })
    it('JobDetailPanel can be imported', async () => {
        const mod = await import('../app/workspace/render/components/JobDetailPanel')
        expect(mod).toBeDefined()
    })
})

describe('Settings components import', () => {
    it('ApiKeysTab can be imported', async () => {
        const mod = await import('../app/workspace/settings/components/ApiKeysTab')
        expect(mod).toBeDefined()
    })
    it('PipelineTab can be imported', async () => {
        const mod = await import('../app/workspace/settings/components/PipelineTab')
        expect(mod).toBeDefined()
    })
    it('GpuTab can be imported', async () => {
        const mod = await import('../app/workspace/settings/components/GpuTab')
        expect(mod).toBeDefined()
    })
})
