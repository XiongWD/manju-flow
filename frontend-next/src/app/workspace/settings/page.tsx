'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/workspace/PageHeader'
import { TabButton } from './components/TabButton'
import { ApiKeysTab } from './components/ApiKeysTab'
import { PipelineTab } from './components/PipelineTab'
import { GpuTab } from './components/GpuTab'

type Tab = 'apikeys' | 'pipeline' | 'gpu'

export default function WorkspaceSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('apikeys')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <PageHeader title="工作区设置" description="管理接口密钥、流水线参数与 GPU 资源配置。" />

      <div className="flex items-center gap-2 border-b border-zinc-800 pb-px">
        <TabButton
          active={activeTab === 'apikeys'}
          onClick={() => setActiveTab('apikeys')}
          label="接口密钥"
          icon="🔑"
        />
        <TabButton
          active={activeTab === 'pipeline'}
          onClick={() => setActiveTab('pipeline')}
          label="流水线"
          icon="⚡"
        />
        <TabButton
          active={activeTab === 'gpu'}
          onClick={() => setActiveTab('gpu')}
          label="GPU 实例"
          icon="🖥️"
        />
      </div>

      {activeTab === 'apikeys' && <ApiKeysTab />}
      {activeTab === 'pipeline' && <PipelineTab />}
      {activeTab === 'gpu' && <GpuTab />}
    </div>
  )
}
