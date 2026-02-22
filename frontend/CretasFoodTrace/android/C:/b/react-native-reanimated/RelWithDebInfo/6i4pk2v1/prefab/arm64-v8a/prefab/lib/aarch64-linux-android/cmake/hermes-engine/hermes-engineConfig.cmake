if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/jietaoxie/.gradle/caches/8.13/transforms/4c74be79a136179d2c0cdf77ec3a7dd0/transformed/hermes-android-0.79.6-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/jietaoxie/.gradle/caches/8.13/transforms/4c74be79a136179d2c0cdf77ec3a7dd0/transformed/hermes-android-0.79.6-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

