use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

#[derive(Debug, Default)]
pub struct TaskControl {
    cancelled: AtomicBool,
    paused: AtomicBool,
}

impl TaskControl {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        self.paused.store(false, Ordering::Relaxed);
    }

    pub fn pause(&self) {
        if !self.is_cancelled() {
            self.paused.store(true, Ordering::Relaxed);
        }
    }

    pub fn resume(&self) {
        self.paused.store(false, Ordering::Relaxed);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Relaxed)
    }

    /// Cooperative checkpoint used by built-in extractors and output materialization.
    /// External RAR/7Z processes can only observe pause before and after the process call.
    pub fn checkpoint(&self) -> bool {
        while self.is_paused() && !self.is_cancelled() {
            thread::sleep(Duration::from_millis(80));
        }
        self.is_cancelled()
    }
}
