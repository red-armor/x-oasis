import { describe, vi, beforeEach, test, expect } from 'vitest'
import { ObjectHook, OutputPlugin, PluginDriver } from '../plugin-driver/'
import { getOrCreate } from '../plugin-driver/utils'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Plugin = {
  onSuccess: (data: any) => any
  onFail: (error: any) => void
  resolveId: (id: string) => string
  transform: (code: string, id: string) => string

  seq: (data: any) => void
}

const plugin1 = {
  name: 'plugin1',
  onSuccess: vi.fn().mockImplementation((data) => {
    return data
  }),
  onFail: vi.fn(),
  resolveId: vi.fn().mockImplementation(() => 'nextr____'),
  transform: vi.fn().mockImplementation(async (code, id) => {
    return code + id
  }),

  seq: vi.fn().mockImplementation(async () => {}),
} satisfies ObjectHook<Plugin> & OutputPlugin

const plugin2 = {
  name: 'plugin2',
  onSuccess: vi.fn().mockImplementation((data) => {
    return data
  }),
  onFail: vi.fn().mockImplementation(async () => {}),
  resolveId: vi.fn().mockImplementation(() => null),
  transform: vi.fn().mockImplementation(async (code, id) => {
    return ''
  }),

  seq: vi.fn().mockImplementation(async () => {}),
} satisfies ObjectHook<Plugin> & OutputPlugin

describe('test plugin driver', () => {
  const pluginDriver = new PluginDriver<
    Plugin,
    'onSuccess' | 'resolveId',
    'onSuccess' | 'seq',
    'resolveId' | 'transform',
    'onFail'
    // 'onFail'
  >()

  beforeEach(() => {
    pluginDriver.resetPlugins()
    plugin1.onFail.mockClear()
    plugin1.onSuccess.mockClear()
    plugin1.resolveId.mockClear()
    plugin2.onFail.mockClear()
    plugin2.onSuccess.mockClear()
    plugin2.resolveId.mockClear()
  })

  test('hook first should stop when first plugin return a non-nullable value', async () => {
    pluginDriver.setPlugins([plugin1])
    const result = pluginDriver.hookFirstSync('resolveId', ['nextr'])
    expect(plugin1.resolveId).toBeCalledWith('nextr')

    expect(plugin2.resolveId).not.toBeCalled()
    expect(result).toBe('nextr____')
  })

  test('hook first not return value', async () => {
    pluginDriver.setPlugins([plugin2])
    const result = pluginDriver.hookFirstSync('resolveId', ['nextr'])
    expect(result).toBeNull()
    expect(plugin2.resolveId).toBeCalledWith('nextr')
  })

  test('hook first throw an error', async () => {
    const p1 = {
      ...plugin1,
      resolveId: vi.fn().mockImplementation(() => {
        throw new Error('error')
      }),
    }
    pluginDriver.setPlugins([p1])
    expect(() =>
      pluginDriver.hookFirstSync('resolveId', ['nextr'])
    ).toThrowError()
  })

  test('can add plugin', async () => {
    pluginDriver.addPlugin(plugin2)

    expect(pluginDriver.getPlugins().length).toBe(1)
  })

  test('should run parallel hook', async () => {
    pluginDriver.setPlugins([plugin1, plugin2])
    const error = new Error()
    await pluginDriver.hookParallel('onFail', [error])

    expect(plugin1.onFail).toBeCalledWith(error)
    expect(plugin2.onFail).toBeCalledWith(error)
  })

  test('should run parallel hook if hook throw an error will continue go on finally throw an error', async () => {
    const plugin3 = {
      ...plugin2,
      onFail: vi.fn().mockImplementation(async () => {
        throw new Error('error')
      }),
    }
    pluginDriver.setPlugins([plugin1, plugin3, plugin2])
    const error = new Error()
    const catchFn = vi.fn()
    await pluginDriver.hookParallel('onFail', [error]).catch(catchFn)

    expect(plugin1.onFail).toBeCalledWith(error)
    expect(plugin2.onFail).toBeCalledWith(error)
    expect(plugin3.onFail).toBeCalledWith(error)
    expect(catchFn).toBeCalled()
  })

  test('should run parallel hook if has a sync hook, waiting for promise resolved and go on', async () => {
    const p1 = {
      ...plugin1,
      onFail: vi.fn().mockImplementation(async (error) => {
        await sleep(100)
      }),
    }
    const p2 = {
      ...plugin1,
      onFail: {
        sequential: true,
        handler: vi.fn().mockImplementation(() => {}),
      },
    }

    pluginDriver.setPlugins([p1, p2])

    const error = new Error()
    pluginDriver.hookParallel('onFail', [error])
    await sleep(0)
    expect(p1.onFail).toBeCalled()
    expect(p2.onFail.handler).not.toBeCalled()
    await sleep(100)
    expect(p2.onFail.handler).toBeCalled()
  })

  test('async hookFirst ', async () => {
    pluginDriver.setPlugins([plugin1, plugin2])
    const result = await pluginDriver.hookFirst('transform', [
      'nextr',
      ' __nextr',
    ])
    expect(result).toBe('nextr __nextr')
    expect(plugin1.transform).toBeCalledWith('nextr', ' __nextr')
    expect(plugin2.transform).not.toBeCalled()
  })

  test('plugin order and hook sync', async () => {
    let count = 0
    const p1 = {
      name: 'p1',
      seq: {
        order: 'post' as const,
        handler(data) {
          expect(count).toBe(1)

          return
        },
      },
    }

    const p2 = {
      name: 'p2',
      seq: {
        handler(data) {
          expect(count).toBe(0)
          count++
          return
        },
        order: 'pre' as const,
      },
    }

    pluginDriver.setPlugins([p1, p2])

    await pluginDriver.hookSeq('seq', ['pre'])
  })

  test('hook reduce value', async () => {
    const p1 = {
      ...plugin1,
      onSuccess: (data) => '1',
    }

    const p2 = {
      ...plugin1,
      onSuccess: (data) => '2',
    }
    pluginDriver.setPlugins([p1, p2])
    const result = pluginDriver.hookReduceValueSync(
      'onSuccess',
      [],
      ['initial'],
      (acc: string[], data) => {
        return [...acc, data]
      }
    )

    expect(result).toEqual(['1', '2'])
  })
})

test('getOrCreate', async () => {
  const map = new Map()
  const result = getOrCreate(map, 'a', () => 'b')
  expect(result).toBe('b')
  expect(map.get('a')).toBe('b')
  const result2 = getOrCreate(map, 'a', () => 'c')
  expect(result2).toBe('b')
})
