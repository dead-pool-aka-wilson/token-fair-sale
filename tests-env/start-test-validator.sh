#!/bin/bash

solana-test-validator \
    --account 2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ test-validator/accounts/whirlpools_config.2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ.json \
    --account 62dSkn5ktwY1PoKPNMArZA4bZsvyemuknWUnnQ2ATTuN test-validator/accounts/whirlpools_config_feetier1.62dSkn5ktwY1PoKPNMArZA4bZsvyemuknWUnnQ2ATTuN.json \
    --account HT55NVGVTjWmWLjV7BrSMPVZ7ppU8T2xE5nCAZ6YaGad test-validator/accounts/whirlpools_config_feetier64.HT55NVGVTjWmWLjV7BrSMPVZ7ppU8T2xE5nCAZ6YaGad.json \
    --account BGnhGXT9CCt5WYS23zg9sqsAT2MGXkq7VSwch9pML82W test-validator/accounts/whirlpools_config_feetier128.BGnhGXT9CCt5WYS23zg9sqsAT2MGXkq7VSwch9pML82W.json \
    --bpf-program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc test-validator/programs/whirlpool.so \
    --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s test-validator/programs/metadata.so \
    --reset

