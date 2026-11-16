import { useEffect, useState } from 'react'

export default function usePersistentState(key, initialValue) {
    const [value, setValue] = useState(() => {
        try {
            const saved = localStorage.getItem(key)
            return saved !== null ? JSON.parse(saved) : initialValue
        } catch {
            return initialValue
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value))
        } catch (error) {
            console.error('Could not save workspace state:', error)
        }
    }, [key, value])

    return [value, setValue]
}