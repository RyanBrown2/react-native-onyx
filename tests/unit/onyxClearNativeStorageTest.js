import AsyncStorageMock from '@react-native-async-storage/async-storage';
import Storage from '../../lib/storage';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYX_KEYS = {
    DEFAULT_KEY: 'defaultKey',
};

jest.useFakeTimers();

let storageCallResolveList = [];
function addStorageCallResolve(name) {
    storageCallResolveList.push(name);
}

function storageCallResolveOrder(methodName) {
    return storageCallResolveList.indexOf(methodName) + 1;
}

let storageCallQueue = [];

// Mock clear to wait for promises and add a delay
Storage.clear = jest.fn(() => Promise.all(storageCallQueue)
    .then(() => {
        const clearPromise = new Promise(resolve => setTimeout(resolve, 500))
            .then(() => AsyncStorageMock.clear())
            .then(addStorageCallResolve('clear'));
        storageCallQueue.push(clearPromise);
        return clearPromise;
    }));

// Mock setItem to wait for promises
Storage.setItem = jest.fn(() => Promise.all(storageCallQueue)
    .then(() => {
        const setItemPromise = AsyncStorageMock.setItem()
            .then(addStorageCallResolve('setItem'));
        storageCallQueue.push(setItemPromise);
        return setItemPromise;
    }));

describe('Set data while storage is clearing', () => {
    let connectionID;
    let Onyx;

    /** @type OnyxCache */
    let cache;

    beforeAll(() => {
        Onyx = require('../../index').default;
        Onyx.init({
            keys: ONYX_KEYS,
            registerStorageEventListener: () => {},
            initialKeyStates: {
                [ONYX_KEYS.DEFAULT_KEY]: 'default',
            },
        });
    });

    // Always use a "fresh" cache instance
    beforeEach(() => {
        cache = require('../../lib/OnyxCache').default;
    });

    afterEach(() => {
        storageCallResolveList = [];
        storageCallQueue = [];
        Onyx.disconnect(connectionID);
        Onyx.clear();
        jest.runAllTimers();
    });

    it('should persist the value of Onyx.merge when called between the cache and storage clearing', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
        const mergedValue = 'merged';
        Onyx.clear();
        Storage.clear = jest.fn(() => {
            // Call merge between the cache and storage clearing
            Onyx.merge(ONYX_KEYS.DEFAULT_KEY, mergedValue);
            const clearPromise = new Promise(resolve => setTimeout(resolve, 500))
                .then(() => AsyncStorageMock.clear())
                .then(addStorageCallResolve('clear'));
            storageCallQueue.push(clearPromise);
            return clearPromise;
        });
        jest.runAllTimers();
        waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('clear')).toBe(1);
                expect(storageCallResolveOrder('setItem')).toBe(2);
                expect(defaultValue).toBe(mergedValue);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(mergedValue);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.toBe(mergedValue);
                Storage.clear.mockRestore();
            });
    });

    it('should persist the value of Onyx.set when called between the cache and storage clearing', () => {
        let defaultValue;
        connectionID = Onyx.connect({
            key: ONYX_KEYS.DEFAULT_KEY,
            initWithStoredValues: false,
            callback: val => defaultValue = val,
        });
        const setValue = 'set';
        Onyx.clear();
        Storage.clear = jest.fn(() => {
            // Call set between the cache and storage clearing
            Onyx.set(ONYX_KEYS.DEFAULT_KEY, setValue);
            const clearPromise = new Promise(resolve => setTimeout(resolve, 500))
                .then(() => AsyncStorageMock.clear())
                .then(addStorageCallResolve('clear'));
            storageCallQueue.push(clearPromise);
            return clearPromise;
        });
        jest.runAllTimers();
        waitForPromisesToResolve()
            .then(() => {
                expect(storageCallResolveOrder('clear')).toBe(1);
                expect(storageCallResolveOrder('setItem')).toBe(2);
                expect(defaultValue).toBe(setValue);
                const cachedValue = cache.getValue(ONYX_KEYS.DEFAULT_KEY);
                expect(cachedValue).toBe(setValue);
                const storedValue = Storage.getItem(ONYX_KEYS.DEFAULT_KEY);
                expect(storedValue).resolves.toBe(setValue);
                Storage.clear.mockRestore();
            });
    });
});